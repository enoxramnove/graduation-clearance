const role = requireRole(['Guild', 'Librarian', 'Finance', 'HOD', 'Dean', 'AR']);
const tableBody = document.getElementById('requestTableBody');
const dashboardError = document.getElementById('dashboardError');

if (role) {
    document.getElementById('roleTitle').textContent = `${role} Clearance Dashboard`;
    loadRequests();
}

async function loadRequests() {
    dashboardError.hidden = true;
    tableBody.replaceChildren();
    try {
        const data = await apiRequest('/api/officer/requests');
        if (!data.requests.length) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.textContent = `There are no pending requests for ${data.stage}.`;
            return;
        }

        for (const request of data.requests) {
            const row = tableBody.insertRow();
            row.insertCell().textContent = request.request_id;
            row.insertCell().textContent = `${request.fullname} (${request.reg_no})`;
            row.insertCell().textContent = request.current_stage;
            const statusCell = row.insertCell();
            const badge = document.createElement('span');
            badge.className = `status-badge ${request.status === 'Pending' ? 'status-pending' : ''}`;
            badge.textContent = request.status;
            statusCell.appendChild(badge);
            const actions = row.insertCell();
            const approve = document.createElement('button');
            approve.textContent = 'Approve';
            approve.addEventListener('click', () => decide(request.request_id, 'approve'));
            actions.appendChild(approve);
            const reject = document.createElement('button');
            reject.textContent = 'Reject';
            reject.className = 'danger action-secondary';
            reject.addEventListener('click', () => decide(request.request_id, 'reject'));
            actions.appendChild(reject);
        }
    } catch (error) {
        showError(dashboardError, error);
    }
}

async function decide(requestId, decision) {
    let comments;
    if (decision === 'reject') {
        comments = window.prompt('Enter the reason for rejection (required):');
        if (comments === null) return;
        comments = comments.trim();
        if (!comments) {
            showError(dashboardError, new Error('A rejection reason is required.'));
            return;
        }
    }

    dashboardError.hidden = true;
    try {
        await apiRequest(`/api/requests/${requestId}/${decision}`, {
            method: 'POST',
            ...(comments === undefined ? {} : { body: { comments } })
        });
        await loadRequests();
    } catch (error) {
        showError(dashboardError, error);
    }
}
