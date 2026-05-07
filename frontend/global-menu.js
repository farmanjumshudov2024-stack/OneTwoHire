document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Global Auth Check ---
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');

    const loginUrl = 'index.html';

    if (!isLoggedIn && !isIndexPage) {
        // Redirect unauthorized access to login index
        window.location.href = loginUrl;
        return;
    }

    // --- 2. 3-Dot Menu Logic ---
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdownContent = document.getElementById('user-dropdown-content');
    const menuLogoutBtn = document.getElementById('menu-logout');
    
    // Toggle Menu
    if (userMenuBtn && userDropdownContent) {
        userMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isVisible = userDropdownContent.style.display === 'block';
            userDropdownContent.style.display = isVisible ? 'none' : 'block';
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdownContent.contains(e.target)) {
                userDropdownContent.style.display = 'none';
            }
        });
    }

    // Logout Logic
    if (menuLogoutBtn) {
        menuLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isLoggedIn');
            
            // Redirect to index (which shows login)
            window.location.href = loginUrl;
        });
    }

});
