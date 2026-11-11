const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMsg');
const submitButton = loginForm.querySelector('button[type="submit"]');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.hidden = true;
    submitButton.disabled = true;

    try {
        const data = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: {
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            }
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        window.location.replace(data.redirectUrl);
    } catch (error) {
        showError(errorMessage, error);
    } finally {
        submitButton.disabled = false;
    }
});
