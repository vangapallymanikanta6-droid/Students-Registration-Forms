const STORAGE_KEY = 'businesslabs_students';
const SESSION_KEY = 'businesslabs_session';
const ADMIN_EMAIL = 'admin@businesslabs.com';
const ADMIN_PASSWORD = 'admin123';

const apiRequest = async (endpoint, options = {}) => {
  const response = await fetch(endpoint, options);
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed');
  }

  return payload;
};

const syncLocalUsers = async () => {
  try {
    const result = await apiRequest('/api/users');
    if (Array.isArray(result?.users)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.users));
      return result.users;
    }
  } catch (error) {
    // Ignore fetch errors and fall back to local storage.
  }

  const currentUsers = getUsers();
  return currentUsers;
};

const getUsers = () => {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) {
    const admin = {
      id: 1,
      name: 'Administrator',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([admin]));
    return [admin];
  }
  return JSON.parse(value);
};

const saveUsers = (users) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

const getCurrentSession = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');

const setCurrentSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const logout = () => {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
};

const formatAge = (dob) => {
  if (!dob) return 'N/A';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const diff = Date.now() - date.getTime();
  const age = new Date(diff);
  return Math.abs(age.getUTCFullYear() - 1970);
};

const showError = (elementId, message) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
};

const clearError = (elementId) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.classList.remove('show');
};

const readFileAsDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
};

const uniqueFileName = (originalName, userId) => {
  const safeName = (originalName || 'aadhaar.pdf').replace(/\s+/g, '_');
  const timeStamp = Date.now();
  const ext = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : '.pdf';
  return `aadhaar_${userId}_${timeStamp}${ext}`;
};

const getSelectedInterests = (selectorName) => {
  const checked = document.querySelectorAll(`input[name="${selectorName}"]:checked`);
  return Array.from(checked).map((item) => item.value);
};

const buildAadhaarLink = (user) => {
  if (user.aadhaarDataUrl) {
    return `<a class="aadhaar-link" href="${user.aadhaarDataUrl}" target="_blank" rel="noreferrer">Open PDF</a>`;
  }
  return 'No file';
};

const redirectIfLoggedIn = () => {
  const session = getCurrentSession();
  const path = window.location.pathname.split('/').pop() || 'index.html';

  if (!session && path !== 'index.html' && path !== 'login.html') {
    window.location.href = 'login.html';
    return false;
  }

  if (session && session.role === 'admin' && path !== 'admin.html') {
    window.location.href = 'admin.html';
    return false;
  }

  if (session && session.role === 'student' && path !== 'student.html') {
    window.location.href = 'student.html';
    return false;
  }

  return true;
};

const setupLogoutButtons = () => {
  document.querySelectorAll('#logoutBtn').forEach((button) => {
    button.addEventListener('click', logout);
  });
};

const setupSignupForm = async () => {
  const form = document.getElementById('signupForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError('errorBox');

    const formData = new FormData(form);
    const name = (formData.get('name') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const password = (formData.get('password') || '').toString().trim();
    const dob = (formData.get('dob') || '').toString();
    const gender = form.querySelector('input[name="gender"]:checked')?.value || '';
    const qualification = (formData.get('qualification') || '').toString();
    const className = (formData.get('className') || '').toString().trim();
    const subject = (formData.get('subject') || '').toString().trim();
    const marks = Number(formData.get('marks'));
    const file = formData.get('aadhaarFile');
    const interests = getSelectedInterests('interests');

    const users = getUsers();
    if (users.some((user) => user.email && user.email.toLowerCase() === email.toLowerCase())) {
      showError('errorBox', 'This email is already registered.');
      return;
    }

    if (file && file.size > 0 && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showError('errorBox', 'Aadhaar upload must be a PDF file.');
      return;
    }

    if (!file || file.size === 0) {
      showError('errorBox', 'Please upload your Aadhaar PDF.');
      return;
    }

    try {
      const payload = new FormData();
      payload.append('name', name);
      payload.append('email', email);
      payload.append('password', password);
      payload.append('dob', dob);
      payload.append('gender', gender);
      payload.append('qualification', qualification);
      payload.append('className', className);
      payload.append('subject', subject);
      payload.append('marks', String(marks));
      payload.append('interests', JSON.stringify(interests));
      payload.append('aadhaarFile', file);

      const result = await apiRequest('/api/register', {
        method: 'POST',
        body: payload,
      });

      if (result?.success) {
        form.reset();
        alert('Registration successful! Please login.');
        window.location.href = 'login.html';
        return;
      }

      showError('errorBox', result?.message || 'Registration failed.');
    } catch (error) {
      if (error.message === 'This email is already registered.') {
        showError('errorBox', error.message);
        return;
      }

      const localUsers = getUsers();
      const newUser = {
        id: Date.now(),
        name,
        email,
        password,
        dob,
        gender,
        qualification,
        className,
        subject,
        marks,
        interests,
        role: 'student',
        aadhaarFileName: uniqueFileName(file.name, Date.now()),
        aadhaarDataUrl: await readFileAsDataUrl(file),
        createdAt: new Date().toISOString(),
      };

      localUsers.push(newUser);
      saveUsers(localUsers);
      form.reset();
      alert('Registration successful! Please login.');
      window.location.href = 'login.html';
    }
  });
};

const setupLoginForm = () => {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError('loginError');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
      const result = await apiRequest('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (result?.user) {
        const user = result.user;
        const users = getUsers();
        const existingUser = users.find((entry) => entry.email && entry.email.toLowerCase() === user.email.toLowerCase());
        if (!existingUser) {
          saveUsers([...users, user]);
        }

        setCurrentSession({ userId: user.id, role: user.role });
        if (user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'student.html';
        }
        return;
      }
    } catch (error) {
      // Fall back to localStorage logic below.
    }

    const users = getUsers();
    const user = users.find((entry) => entry.email && entry.email.toLowerCase() === email.toLowerCase() && entry.password === password);

    if (!user) {
      showError('loginError', 'Invalid email or password.');
      return;
    }

    setCurrentSession({ userId: user.id, role: user.role });
    if (user.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'student.html';
    }
  });

  const forgot = document.getElementById('forgotPasswordBtn');
  forgot?.addEventListener('click', async () => {
    const emailInput = window.prompt('Enter your email address to recover your password:');
    if (!emailInput) return;

    const users = getUsers();
    const user = users.find((entry) => entry.email.toLowerCase() === emailInput.trim().toLowerCase());
    if (!user) {
      try {
        const result = await apiRequest('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput.trim(), password: 'temp-reset' }),
        });
        if (result?.success) {
          alert('Password updated successfully.');
        }
      } catch (error) {
        alert('No account found for this email.');
      }
      return;
    }

    const newPassword = window.prompt('Enter a new password to reset it:');
    if (newPassword === null || newPassword.trim() === '') {
      return;
    }

    try {
      await apiRequest('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: newPassword.trim() }),
      });
      user.password = newPassword.trim();
      saveUsers(users);
      alert('Password updated successfully.');
    } catch (error) {
      user.password = newPassword.trim();
      saveUsers(users);
      alert('Password updated successfully.');
    }
  });
};

const getCurrentUser = () => {
  const session = getCurrentSession();
  if (!session) return null;
  return getUsers().find((user) => user.id === session.userId) || null;
};

const setupAdminPage = () => {
  if (!document.getElementById('studentTableBody')) return;

  const session = getCurrentSession();
  if (!session || session.role !== 'admin') {
    window.location.href = 'login.html';
    return;
  }

  const adminUser = getCurrentUser();
  const badge = document.getElementById('adminUserBadge');
  if (badge && adminUser) badge.textContent = `Logged in as ${adminUser.name}`;

  const filterName = document.getElementById('filterName');
  const filterClass = document.getElementById('filterClass');
  const filterMinAge = document.getElementById('filterMinAge');
  const filterMaxAge = document.getElementById('filterMaxAge');
  const tableBody = document.getElementById('studentTableBody');

  const renderTable = async () => {
    const users = (await syncLocalUsers()).filter((user) => user.role === 'student');
    const nameQuery = (filterName.value || '').toLowerCase();
    const classQuery = (filterClass.value || '').toLowerCase();
    const minAge = Number(filterMinAge.value || 0);
    const maxAge = Number(filterMaxAge.value || 200);

    const filteredUsers = users.filter((user) => {
      const matchesName = (user.name || '').toLowerCase().includes(nameQuery);
      const matchesClass = (user.className || '').toLowerCase().includes(classQuery);
      const age = formatAge(user.dob);
      const numericAge = Number(age);
      const matchesMin = !Number.isFinite(numericAge) ? true : numericAge >= minAge;
      const matchesMax = !Number.isFinite(numericAge) ? true : numericAge <= maxAge;
      return matchesName && matchesClass && matchesMin && matchesMax;
    });

    tableBody.innerHTML = filteredUsers.map((user) => `
      <tr>
        <td>#${user.id}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.className || 'N/A'}</td>
        <td>${formatAge(user.dob)}</td>
        <td>${user.qualification || 'N/A'}</td>
        <td>${buildAadhaarLink(user)}</td>
        <td>
          <div class="action-group">
            <button class="action-btn edit" data-action="edit" data-user-id="${user.id}">Edit</button>
            <button class="action-btn delete" data-action="delete" data-user-id="${user.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  };

  [filterName, filterClass, filterMinAge, filterMaxAge].forEach((input) => {
    input.addEventListener('input', renderTable);
  });

  tableBody.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    const userId = Number(target.dataset.userId);
    const action = target.dataset.action;
    const users = await syncLocalUsers();
    const user = users.find((entry) => entry.id === userId);

    if (!user) return;

    if (action === 'delete') {
      const confirmed = window.confirm(`Delete ${user.name}?`);
      if (!confirmed) return;

      try {
        await apiRequest(`/api/users/${userId}`, { method: 'DELETE' });
      } catch (error) {
        const updated = users.filter((entry) => entry.id !== userId);
        saveUsers(updated);
      }

      await renderTable();
      return;
    }

    if (action === 'edit') {
      const modal = document.getElementById('editModal');
      const editName = document.getElementById('editName');
      const editEmail = document.getElementById('editEmail');
      const editPassword = document.getElementById('editPassword');
      const editDob = document.getElementById('editDob');
      const editClass = document.getElementById('editClass');
      const editQualification = document.getElementById('editQualification');
      const editMarks = document.getElementById('editMarks');

      editName.value = user.name;
      editEmail.value = user.email;
      editPassword.value = user.password || '';
      editDob.value = user.dob || '';
      editClass.value = user.className || '';
      editQualification.value = user.qualification || '10th';
      editMarks.value = user.marks || '';

      modal.dataset.userId = String(user.id);
      modal.classList.remove('hidden');
    }
  });

  document.querySelectorAll('.close-modal').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById('editModal').classList.add('hidden');
      clearError('editError');
    });
  });

  document.getElementById('editStudentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError('editError');
    const modal = document.getElementById('editModal');
    const userId = Number(modal.dataset.userId);
    const users = await syncLocalUsers();
    const user = users.find((entry) => entry.id === userId);

    if (!user) return;

    const file = document.getElementById('editAadhaar').files[0];
    if (file && file.size > 0 && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showError('editError', 'Aadhaar upload must be a PDF file.');
      return;
    }

    const formData = new FormData();
    formData.append('name', document.getElementById('editName').value.trim());
    formData.append('password', document.getElementById('editPassword').value.trim() || user.password);
    formData.append('dob', document.getElementById('editDob').value);
    formData.append('className', document.getElementById('editClass').value.trim());
    formData.append('qualification', document.getElementById('editQualification').value);
    formData.append('marks', String(document.getElementById('editMarks').value || 0));
    formData.append('interests', JSON.stringify(user.interests || []));

    if (file && file.size > 0) {
      formData.append('aadhaarFile', file);
    }

    try {
      const result = await apiRequest(`/api/users/${userId}`, {
        method: 'PUT',
        body: formData,
      });
      if (result?.success) {
        await syncLocalUsers();
      }
    } catch (error) {
      user.name = document.getElementById('editName').value.trim();
      user.password = document.getElementById('editPassword').value.trim() || user.password;
      user.dob = document.getElementById('editDob').value;
      user.className = document.getElementById('editClass').value.trim();
      user.qualification = document.getElementById('editQualification').value;
      user.marks = Number(document.getElementById('editMarks').value || 0);
      if (file && file.size > 0) {
        user.aadhaarDataUrl = await readFileAsDataUrl(file);
        user.aadhaarFileName = uniqueFileName(file.name, user.id);
      }
      saveUsers(users);
    }

    modal.classList.add('hidden');
    await renderTable();
  });

  renderTable();
};

const setupStudentPage = () => {
  const target = document.getElementById('studentProfileDetails');
  if (!target) return;

  const session = getCurrentSession();
  if (!session || session.role !== 'student') {
    window.location.href = 'login.html';
    return;
  }

  const student = getCurrentUser();
  const badge = document.getElementById('studentUserBadge');
  if (badge && student) badge.textContent = `User ID #${student.id}`;

  const banner = document.getElementById('welcomeBanner');
  if (banner && student) {
    banner.textContent = `Welcome, ${student.name} (User ID: #${student.id})`;
  }

  const details = document.getElementById('studentProfileDetails');
  if (details && student) {
    details.innerHTML = `
      <div class="detail-item"><span class="label">Email</span><span class="value">${student.email}</span></div>
      <div class="detail-item"><span class="label">Password</span><span class="value">${student.password}</span></div>
      <div class="detail-item"><span class="label">Date of Birth</span><span class="value">${student.dob || 'N/A'}</span></div>
      <div class="detail-item"><span class="label">Gender</span><span class="value">${student.gender || 'N/A'}</span></div>
      <div class="detail-item"><span class="label">Qualification</span><span class="value">${student.qualification || 'N/A'}</span></div>
      <div class="detail-item"><span class="label">Class</span><span class="value">${student.className || 'N/A'}</span></div>
      <div class="detail-item"><span class="label">Subject</span><span class="value">${student.subject || 'N/A'}</span></div>
      <div class="detail-item"><span class="label">Marks</span><span class="value">${student.marks ?? 'N/A'}</span></div>
      <div class="detail-item"><span class="label">Interests</span><span class="value">${(student.interests || []).join(', ') || 'N/A'}</span></div>
      <div class="detail-item"><span class="label">Aadhaar</span><span class="value">${student.aadhaarDataUrl ? `<a class="aadhaar-link" href="${student.aadhaarDataUrl}" target="_blank" rel="noreferrer">Open PDF</a>` : 'N/A'}</span></div>
    `;
  }

  document.getElementById('editProfileBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('studentEditModal');
    const studentForm = document.getElementById('studentEditForm');

    if (!student || !modal || !studentForm) return;

    document.getElementById('studentEditName').value = student.name || '';
    document.getElementById('studentEditEmail').value = student.email || '';
    document.getElementById('studentEditPassword').value = student.password || '';
    document.getElementById('studentEditDob').value = student.dob || '';
    document.getElementById('studentEditQualification').value = student.qualification || '10th';
    document.getElementById('studentEditClass').value = student.className || '';
    document.getElementById('studentEditSubject').value = student.subject || '';
    document.getElementById('studentEditMarks').value = student.marks || '';

    const genderValue = student.gender || 'Male';
    document.querySelectorAll('input[name="studentGender"]').forEach((radio) => {
      radio.checked = radio.value === genderValue;
    });

    document.querySelectorAll('input[name="studentInterests"]').forEach((checkbox) => {
      checkbox.checked = (student.interests || []).includes(checkbox.value);
    });

    modal.classList.remove('hidden');
  });

  document.querySelectorAll('.close-modal').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById('studentEditModal').classList.add('hidden');
      clearError('studentEditError');
    });
  });

  document.getElementById('studentEditForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError('studentEditError');
    const users = getUsers();
    const activeUser = users.find((entry) => entry.id === student.id);
    if (!activeUser) return;

    const file = document.getElementById('studentEditAadhaar').files[0];
    if (file && file.size > 0 && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showError('studentEditError', 'Aadhaar upload must be a PDF file.');
      return;
    }

    activeUser.name = document.getElementById('studentEditName').value.trim();
    activeUser.password = document.getElementById('studentEditPassword').value.trim() || activeUser.password;
    activeUser.dob = document.getElementById('studentEditDob').value;
    activeUser.gender = document.querySelector('input[name="studentGender"]:checked')?.value || activeUser.gender;
    activeUser.qualification = document.getElementById('studentEditQualification').value;
    activeUser.className = document.getElementById('studentEditClass').value.trim();
    activeUser.subject = document.getElementById('studentEditSubject').value.trim();
    activeUser.marks = Number(document.getElementById('studentEditMarks').value || 0);
    activeUser.interests = getSelectedInterests('studentInterests');

    if (file && file.size > 0) {
      activeUser.aadhaarDataUrl = await readFileAsDataUrl(file);
      activeUser.aadhaarFileName = uniqueFileName(file.name, activeUser.id);
    }

    saveUsers(users);
    document.getElementById('studentEditModal').classList.add('hidden');
    window.location.reload();
  });
};

document.addEventListener('DOMContentLoaded', () => {
  if (!redirectIfLoggedIn()) return;
  setupLogoutButtons();
  setupSignupForm();
  setupLoginForm();
  setupAdminPage();
  setupStudentPage();
});
