document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const currentUser = localStorage.getItem('currentUser');
    


    // CV Rendering
    const cvList = document.getElementById('cv-list');
    const emptyState = document.getElementById('empty-state');

    function loadCVs() {
        cvList.innerHTML = '';
        const savedRaw = localStorage.getItem(`userCVs_${currentUser}`);
        let cvs = [];
        if (savedRaw) {
            try { cvs = JSON.parse(savedRaw); } catch(e){}
        }

        if (cvs.length === 0) {
            cvList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        cvList.style.display = 'grid';
        emptyState.style.display = 'none';

        cvs.forEach(cv => {
            const card = document.createElement('div');
            card.className = 'cv-card';
            
            const name = cv.fullName || "Untitled CV";
            const role = cv.targetJobTitle || "No role specified";
            const date = new Date(cv.updatedAt).toLocaleDateString();
            
            card.innerHTML = `
                <h3>${name}</h3>
                <p class="job-title">${role}</p>
                <p class="meta">Last Updated: ${date}</p>
                <div class="cv-actions">
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${cv.id}">Edit</button>
                    <button class="btn btn-outline btn-sm delete-btn" data-id="${cv.id}" style="color: var(--danger-color); border-color: var(--danger-color);"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            cvList.appendChild(card);
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this CV?")) {
                    deleteCV(id);
                }
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                localStorage.setItem('activeCVEditId', id);
                window.location.href = 'index.html';
            });
        });
    }

    function deleteCV(id) {
        const savedRaw = localStorage.getItem(`userCVs_${currentUser}`);
        if (!savedRaw) return;
        let cvs = JSON.parse(savedRaw);
        cvs = cvs.filter(c => c.id !== id);
        localStorage.setItem(`userCVs_${currentUser}`, JSON.stringify(cvs));
        loadCVs();
    }

    loadCVs();
});
