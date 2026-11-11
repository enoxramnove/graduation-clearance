const statusInfo = document.getElementById('statusInfo');
const actionButtons = document.getElementById('actionButtonContainer');
const rejectionReason = document.getElementById('rejectionReason');
const historyList = document.getElementById('historyList');
const notificationList = document.getElementById('notificationList');
const dashboardError = document.getElementById('dashboardError');
const workflowStages = ['Guild', 'Library', 'Finance', 'HOD', 'Dean', 'AR', 'Completed'];

requireRole(['Student']);

function addButton(label, action, className = '') {
    const button = document.createElement('button');
    button.textContent = label;
    if (className) button.className = className;
    button.addEventListener('click', action);
    actionButtons.appendChild(button);
}

async function submitRequest() {
    try {
        await apiRequest('/api/requests/submit', { method: 'POST' });
        await loadDashboard();
    } catch (error) {
        showError(dashboardError, error);
    }
}

async function resubmitRequest() {
    try {
        await apiRequest('/api/requests/resubmit', { method: 'POST' });
        await loadDashboard();
    } catch (error) {
        showError(dashboardError, error);
    }
}

async function loadDashboard() {
    dashboardError.hidden = true;
    rejectionReason.hidden = true;
    rejectionReason.textContent = '';
    statusInfo.textContent = 'Loading clearance status...';
    try {
        const data = await apiRequest('/api/student/status');
        actionButtons.replaceChildren();
        historyList.replaceChildren();
        notificationList.replaceChildren();

        if (!data.request) {
            statusInfo.textContent = 'You have not submitted a clearance request yet.';
            addButton('Submit clearance request', submitRequest);
        } else {
            const request = data.request;
            statusInfo.textContent = `Request #${request.request_id}: ${request.status} — ${
                request.status === 'Completed' ? 'Clearance completed' : `currently with ${request.current_stage}`
            }.`;

            if (request.status === 'Rejected') {
                const rejection = [...data.history].reverse().find((item) => item.decision === 'Rejected');
                rejectionReason.textContent =
                    `Rejection reason: ${rejection?.comments || 'No reason was recorded.'}`;
                rejectionReason.hidden = false;
                addButton('Resubmit to rejecting department', resubmitRequest);
            }

            const activeIndex = workflowStages.indexOf(request.current_stage);
            for (const [index, stage] of workflowStages.entries()) {
                const item = document.createElement('li');
                const approval = data.history.find((entry) =>
                    entry.department === stage && entry.decision === 'Approved'
                );
                const isRejectedStage = request.status === 'Rejected' &&
                    (request.last_rejected_by === stage ||
                        (request.last_rejected_by === 'Librarian' && stage === 'Library'));
                item.className = approval || (stage === 'Completed' && request.status === 'Completed')
                    ? 'stage-complete' :
                    isRejectedStage ? 'stage-rejected' :
                        index === activeIndex && request.status === 'Pending' ? 'stage-current' : '';
                item.textContent = `${stage}${approval ? ' — Approved' :
                    isRejectedStage ? ' — Rejected' :
                        index === activeIndex && request.status === 'Pending' ? ' — In progress' : ''}`;
                historyList.appendChild(item);
            }
        }

        for (const notification of data.notifications) {
            const item = document.createElement('li');
            item.textContent = `${new Date(notification.created_at).toLocaleString()}: ${notification.message}`;
            notificationList.appendChild(item);
        }
        if (!data.notifications.length) {
            notificationList.textContent = 'No notifications yet.';
        }
    } catch (error) {
        statusInfo.textContent = '';
        showError(dashboardError, error);
    }
}

loadDashboard();
