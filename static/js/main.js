/**
 * HostelFlow — Vanilla JavaScript Client Module
 * Handles mobile hamburger toggle, dropdown menus, toast alerts,
 * check-in flow events, and interactive UI behaviors.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFlashAutoDismiss();
});

/**
 * Mobile Navigation & User Dropdown Controllers
 */
function initNavigation() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.getElementById('navMenu');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');

    if (hamburgerBtn && navMenu) {
        hamburgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('show');
        });
    }

    if (userMenuBtn && userDropdownMenu) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownMenu.classList.toggle('show');
        });

        // Close user dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userDropdownMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
                userDropdownMenu.classList.remove('show');
            }
        });
    }
}

/**
 * Automatically dismisses flash banners after 6 seconds
 */
function initFlashAutoDismiss() {
    const flashWrapper = document.getElementById('flashWrapper');
    if (!flashWrapper) return;

    const alerts = flashWrapper.querySelectorAll('.alert');
    alerts.forEach((alert) => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => alert.remove(), 400);
        }, 6000);
    });
}

/**
 * Reusable dynamic toast popup
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.cssText = 'box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);min-width:280px;';
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}
