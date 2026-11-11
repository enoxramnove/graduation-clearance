const dashboardError = document.getElementById('dashboardError');
const role = requireRole(['FacultyHead']);

if (role) loadOverview();

function appendCell(row, value) {
    const cell = row.insertCell();
    cell.textContent = value == null || value === '' ? '-' : value;
    return cell;
}

async function loadOverview() {
    dashboardError.hidden = true;
    try {
        const data = await apiRequest('/api/faculty-head/overview');
        document.getElementById('statTotal').textContent = data.stats.total;
        document.getElementById('statCompleted').textContent = data.stats.completed;
        document.getElementById('statPending').textContent = data.stats.pending;
        document.getElementById('statRejected').textContent = data.stats.rejected;

        const bottleneckList = document.getElementById('bottleneckList');
        bottleneckList.replaceChildren();
        if (!data.bottlenecks.length) {
            bottleneckList.textContent = 'No pending bottlenecks. All clear!';
        } else {
            for (const bottleneck of data.bottlenecks) {
                const item = document.createElement('li');
                item.textContent = `${bottleneck.current_stage}: ${bottleneck.pending_count} pending request(s)`;
                bottleneckList.appendChild(item);
            }
        }

        const auditBody = document.getElementById('auditTableBody');
        auditBody.replaceChildren();
        if (!data.recentActivity.length) {
            const row = auditBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.textContent = 'No activity recorded yet.';
        } else {
            for (const activity of data.recentActivity) {
                const row = auditBody.insertRow();
                appendCell(row, new Date(activity.action_date).toLocaleString());
                appendCell(row, `${activity.reg_no} (${activity.fullname})`);
                appendCell(row, activity.department);
                appendCell(row, activity.decision);
                appendCell(row, activity.comments);
            }
        }
    } catch (error) {
        showError(dashboardError, error);
    }
}
