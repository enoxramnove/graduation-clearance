window.apiRequest = async function (url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(url, {
        ...options,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    let data;
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        if (response.status === 401 && token && url !== '/api/auth/login') {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.replace('/login.html');
        }
        throw new Error(data.error || `Request failed (${response.status}).`);
    }
    return data;
};

window.logout = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.replace('/login.html');
};

window.requireRole = function (roles) {
    const role = localStorage.getItem('role');
    if (!localStorage.getItem('token') || !roles.includes(role)) {
        window.location.replace('/login.html');
        return null;
    }
    return role;
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('logoutButton')?.addEventListener('click', window.logout);
});

window.showError = function (element, error) {
    element.textContent = error.message || 'An unexpected error occurred.';
    element.hidden = false;
};
